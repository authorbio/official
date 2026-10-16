import "./globals.css";

export const metadata = {
  title: "AuthorBIO — Your work, beautifully gathered",
  description: "A minimalist home for authors, writers, and digital creators.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
