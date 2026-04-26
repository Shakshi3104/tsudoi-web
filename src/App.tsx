import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Admin from "./pages/Admin";
import Present from "./pages/Present";
import Leaderboard from "./pages/Leaderboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:eventCode" element={<Join />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/present/:code" element={<Present />} />
        <Route path="/leaderboard/:code" element={<Leaderboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
