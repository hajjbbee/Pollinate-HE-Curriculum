import React from "react";
import "./App.css"; // If you have global styles

function App() {
  return (
    <div
      className="App"
      style={{ padding: "2rem", fontFamily: "system-ui", textAlign: "center" }}
    >
      <h1 style={{ color: "#2d6a4f", fontSize: "3rem" }}>
        ✨ Pollinate Curriculum AI
      </h1>
      <p style={{ fontSize: "1.5rem", color: "#40916c" }}>
        Interest-Led Homeschool Magic for Your Family
      </p>
      <div style={{ margin: "2rem 0" }}>
        <h2 style={{ color: "#1a5f3f" }}>What It Does</h2>
        <ul style={{ textAlign: "left", maxWidth: "600px", margin: "0 auto" }}>
          <li>• Generates a full year of interest-led learning</li>
          <li>
            • Blends Waldorf, Charlotte Mason, Montessori, Gameschooling,
            Steiner, STEAM, unschooling
          </li>
          <li>• Adapts for ADHD, autism, gifted, dyslexia, sensory needs</li>
          <li>• Finds local homeschool events automatically</li>
          <li>
            • Printable packs, high-school transcripts (global), co-op mode
          </li>
        </ul>
      </div>
      <button
        style={{
          padding: "1rem 2rem",
          fontSize: "1.2rem",
          background: "#40916c",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Get Started Now
      </button>
    </div>
  );
}

export default App;
