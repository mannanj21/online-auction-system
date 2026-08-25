import Product from "../models/product.model.js";
import mongoose from "mongoose";
import { getIO } from "../socket/index.js";
import Upload from "../models/upload.model.js";
import { placeBid as placeBidService, BidError } from "../services/bid.service.js";

export const createAuction = async (req, res) => {
  try {
    const {
      itemName,
      startingPrice,
      itemDescription,
      itemCategory,
      itemStartDate,
      itemEndDate,
      formId,
      public_id,
      secure_url,
    } = req.body;

    const start = itemStartDate ? new Date(itemStartDate) : new Date();
    const end = new Date(itemEndDate);
    const price = Number(startingPrice);
    if (
      !itemName?.trim() ||
      !itemDescription?.trim() ||
      !itemCategory?.trim() ||
      !Number.isFinite(price) ||
      price < 1 ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res
        .status(400)
        .json({ message: "Please provide valid auction details and dates" });
    }

    const upload = await Upload.findOne({ formId });

    if (!upload || upload.status !== "pending") {
      return res.status(400).json({
        message: "Invalid upload session",
      });
    }

    if (!public_id || !secure_url) {
      return res.status(400).json({
        message: "Image is required",
      });
    }

    const newAuction = new Product({
      itemName,
      startingPrice: price,
      currentPrice: price,
      itemDescription,
      itemCategory,
      itemImage: {
        public_id,
        url: secure_url,
      },
      itemStartDate: start,
      itemEndDate: end,
      seller: req.user.id,
    });
    await newAuction.save();

    upload.public_id = public_id;
    upload.secure_url = secure_url;
    upload.status = "used";
    await upload.save();

    res
      .status(201)
      .json({ message: "Auction created successfully", newAuction });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating auction", error: error.message });
  }
};

export const showAuction = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter = { itemEndDate: { $gt: new Date() } };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .select(
        "itemName itemDescription currentPrice bids itemEndDate itemCategory itemImage seller",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const formatted = auction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    res.status(200).json({
      auctions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

export const auctionById = async (req, res) => {
  try {
    const { id } = req.params;
    const auction = await Product.findById(id)
      .populate("seller", "name")
      .populate("bids.bidder", "name")
      .populate("winner", "name");

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Auto-set winner when auction has ended and has bids but no winner yet
    const isExpired = new Date(auction.itemEndDate) < new Date();
    if (isExpired && !auction.winner && auction.bids.length > 0) {
      // Highest bid = first after sorting descending
      const sortedBids = [...auction.bids].sort(
        (a, b) => b.bidAmount - a.bidAmount,
      );
      const highestBid = sortedBids[0];
      auction.winner = highestBid.bidder;
      auction.isSold = true;
      await auction.save();
      // Re-populate winner after save
      await auction.populate("winner", "name");
    }

    // If auction is expired, only allow seller and bidders to view it
    if (isExpired) {
      const userId = req.user.id;
      const isSeller = auction.seller._id.toString() === userId;
      const isBidder = auction.bids.some(
        (b) => b.bidder?._id?.toString() === userId,
      );
      if (!isSeller && !isBidder) {
        return res.status(403).json({
          message: "This auction has ended and is no longer available",
        });
      }
    }

    auction.bids.sort((a, b) => new Date(b.bidTime) - new Date(a.bidTime));
    res.status(200).json(auction);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

export const placeBid = async (req, res) => {
  try {
    const { auction, bidderName } = await placeBidService({
      auctionId: req.params.id,
      userId: req.user.id,
      bidAmount: req.body.bidAmount,
    });

    // Broadcast to socket room (presentation concern stays in controller)
    try {
      const io = getIO();
      io.to(req.params.id).emit("auction:bidPlaced", {
        auction,
        bidderName,
        bidderId: req.user.id,
        bidAmount: Number(req.body.bidAmount),
      });
    } catch (socketErr) {
      console.error("Socket broadcast error:", socketErr.message);
    }

    res.status(200).json({ message: "Bid placed successfully", auction });
  } catch (err) {
    if (err instanceof BidError) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    res.status(500).json({ message: "Error placing bid", error: err.message });
  }
};

export const dashboardData = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const dateNow = new Date();
    const stats = await Product.aggregate([
      {
        $facet: {
          totalAuctions: [{ $count: "count" }],
          userAuctionCount: [
            { $match: { seller: userObjectId } },
            { $count: "count" },
          ],
          activeAuctions: [
            {
              $match: {
                itemStartDate: { $lte: dateNow },
                itemEndDate: { $gte: dateNow },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalAuctions = stats[0].totalAuctions[0]?.count || 0;
    const userAuctionCount = stats[0].userAuctionCount[0]?.count || 0;
    const activeAuctions = stats[0].activeAuctions[0]?.count || 0;

    const globalAuction = await Product.find({ itemEndDate: { $gt: dateNow } })
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .limit(4);
    const latestAuctions = globalAuction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    const userAuction = await Product.find({ seller: userObjectId })
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .limit(4);
    const latestUserAuctions = userAuction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    return res.status(200).json({
      totalAuctions,
      userAuctionCount,
      activeAuctions,
      latestAuctions,
      latestUserAuctions,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error getting dashboard data", error: error.message });
  }
};

export const myAuction = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter = { seller: req.user.id };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .select(
        "itemName itemDescription currentPrice bids itemEndDate itemCategory itemImage seller",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const formatted = auction.map((item) => ({
      _id: item._id,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      currentPrice: item.currentPrice,
      bidsCount: item.bids.length,
      timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
      itemCategory: item.itemCategory,
      sellerName: item.seller.name,
      itemPhoto: item.itemImage?.url,
    }));

    res.status(200).json({
      auctions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

export const myBids = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const filter = { "bids.bidder": userId };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .populate("winner", "name")
      .select(
        "itemName itemDescription currentPrice bids itemEndDate itemCategory itemImage seller winner isSold",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formatted = auction.map((item) => {
      const isExpired = new Date(item.itemEndDate) < new Date();
      return {
        _id: item._id,
        itemName: item.itemName,
        itemDescription: item.itemDescription,
        currentPrice: item.currentPrice,
        bidsCount: item.bids.length,
        timeLeft: Math.max(0, new Date(item.itemEndDate) - new Date()),
        itemCategory: item.itemCategory,
        sellerName: item.seller.name,
        itemPhoto: item.itemImage?.url,
        isExpired,
        winner: item.winner
          ? { _id: item.winner._id, name: item.winner.name }
          : null,
        isSold: item.isSold,
      };
    });

    res.status(200).json({
      auctions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching my bids", error: error.message });
  }
};
