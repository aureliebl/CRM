"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const FullPageChat = dynamic(
  () => import("flowise-embed-react").then((module) => module.FullPageChat),
  { ssr: false }
);

export default function FlowisePage() {
  const [chatHeight, setChatHeight] = useState(620);

  useEffect(() => {
    const recompute = () => {
      const nextHeight = Math.max(620, window.innerHeight - 160);
      setChatHeight(nextHeight);
    };

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  return (
    <div
      style={{
        padding: "0 0.4rem 1rem",
      }}
    >
      <div
        style={{
          overflow: "hidden",
          borderRadius: "0.8rem",
          height: "calc(100vh - 150px)",
          minHeight: 620,
        }}
      >
        <FullPageChat
          chatflowid="47146e72-8790-4600-846f-03ba7e0301ae"
          apiHost="/api/flowise"
          theme={{
            chatWindow: {
              height: chatHeight,
            },
          }}
        />
      </div>
    </div>
  );
}
