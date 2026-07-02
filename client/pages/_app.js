import { useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import io from 'socket.io-client';

let globalSocket = null;

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (!globalSocket) {
      const SOCKET_URL =
        process.env.NEXT_PUBLIC_SOCKET_URL || 'https://purple-reversi.onrender.com';
      globalSocket = io(SOCKET_URL, {
        reconnection: true,
      });
      window.__socket = globalSocket;
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="true" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#2a0f4c" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
