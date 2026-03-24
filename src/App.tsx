import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { RoomProvider } from "./lib/room";
import Home from "./pages/Home";
import Canvas from "./pages/Canvas";
import Feed from "./pages/Feed";

export default function App() {
  return (
    <BrowserRouter>
      <RoomProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/canvas" element={<Canvas />} />
          <Route path="/feed" element={<Feed />} />
        </Routes>
      </RoomProvider>
      <Analytics />
    </BrowserRouter>
  );
}
