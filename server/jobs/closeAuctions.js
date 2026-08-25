import Product from "../models/product.model.js";
import { Resend } from "resend";
import { env } from "../config/env.config.js";

const resend = env.resend_api_key ? new Resend(env.resend_api_key) : null;

export const closeAuctions = async () => {
  try {
    const expiredAuctions = await Product.find({
      itemEndDate: { $lt: new Date() },
      isSold: false,
    })
      .populate("seller", "name email")
      .populate("bids.bidder", "name email");

    if (expiredAuctions.length === 0) return;

    console.log(`Found ${expiredAuctions.length} expired auctions to close.`);

    for (const auction of expiredAuctions) {
      try {
        if (auction.bids.length > 0) {
          const sortedBids = [...auction.bids].sort(
            (a, b) => b.bidAmount - a.bidAmount,
          );
          const highestBid = sortedBids[0];
          auction.winner = highestBid.bidder._id;
          auction.isSold = true;
          await auction.save();

          // Notify winner
          if (resend && highestBid.bidder.email) {
            try {
              await resend.emails.send({
                from: "Auctions <noreply@resend.dev>",
                to: highestBid.bidder.email,
                subject: `You won the auction for ${auction.itemName}!`,
                html: `<p>Congratulations ${highestBid.bidder.name}, you won the auction for <strong>${auction.itemName}</strong> with a bid of Rs ${highestBid.bidAmount}.</p>`,
              });
            } catch (emailErr) {
              console.error(`Failed to email winner of auction ${auction._id}:`, emailErr.message);
            }
          }

          // Notify seller
          if (resend && auction.seller?.email) {
            try {
              await resend.emails.send({
                from: "Auctions <noreply@resend.dev>",
                to: auction.seller.email,
                subject: `Your auction for ${auction.itemName} has ended`,
                html: `<p>Hello ${auction.seller.name}, your auction for <strong>${auction.itemName}</strong> has ended. The winning bid was Rs ${highestBid.bidAmount} by ${highestBid.bidder.name}.</p>`,
              });
            } catch (emailErr) {
              console.error(`Failed to email seller of auction ${auction._id}:`, emailErr.message);
            }
          }
        } else {
          // No bids
          auction.isSold = true;
          await auction.save();
        }
      } catch (err) {
        console.error(`Failed to close auction ${auction._id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("Error running closeAuctions job:", error.message);
  }
};
