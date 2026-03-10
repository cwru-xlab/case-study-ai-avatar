export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center min-h-screen py-8 px-4">
      <div className="w-full max-w-md">{children}</div>
    </section>
  );
}
