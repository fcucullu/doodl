import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./lib/auth";
import { RoomProvider } from "./lib/room";
import Home from "./pages/Home";
import Canvas from "./pages/Canvas";
import Feed from "./pages/Feed";
import AuthCallback from "./pages/AuthCallback";
import Apps from "./pages/Apps";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoomProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/canvas" element={<Canvas />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/apps" element={<Apps />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </RoomProvider>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  );
}
