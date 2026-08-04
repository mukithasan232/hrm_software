import { io } from "socket.io-client";
import Cookies from "js-cookie";

// Ensure the URL is correctly mapped. If hosted on the same domain, leave it empty or use process.env
const SOCKET_URL = process.env.NEXT_PUBLIC_SITE_URL || ""; 

export const socket = io(SOCKET_URL, {
  path: "/api/socket/io", // Mapped from server.cjs standard initialization
  addTrailingSlash: false,
  transports: ["polling", "websocket"], // MUST include polling as fallback for proxy issues
  reconnectionAttempts: 5, // STOP THE INFINITE LOOP SPAM
  reconnectionDelay: 3000, // Wait 3 seconds between retries
  timeout: 10000,
  autoConnect: false, // 🔴 Temporarily disable auto-connect to stop the 404 spam
  auth: (cb) => {
    cb({ token: Cookies.get('token') });
  }
});

// Avoid duplicate event listener additions in React Strict Mode
if (!socket.hasListeners("connect_error")) {
  socket.on("connect_error", (err) => {
    console.warn(`⚠️ Socket connection error: ${err.message}`);
    // Prevents the browser console from dying from spam
  });
}
