import { Outlet, useNavigate } from "react-router";
import {Navbar} from "../components/Navbar"
import {Footer} from "../components/Footer"
import LoadingScreen from "../components/LoadingScreen";
import { useSelector } from "react-redux";
import { useEffect } from "react";


export const AdminLayout = () => {
  const { user, loading } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const isAdmin = user?.user?.role === "admin";

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [isAdmin, loading, navigate]);

  if (loading) return <LoadingScreen />;
  if (!isAdmin) return null;

  return (
    <>
      <Navbar />
      <Outlet />
      <Footer/>
    </>
  );
};
