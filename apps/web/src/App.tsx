import React from "react";
import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Routes>
        <Route path="/" element={<div className="p-8 text-2xl font-bold">Constellation</div>} />
      </Routes>
    </div>
  );
}
