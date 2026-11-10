export function Footer() {
  return (
    <footer className="relative z-10 mt-16 border-t border-forest-900/5 bg-paper/70 py-8 text-center text-sm text-forest-900/60">
      <p>
        Made by{" "}
        <a href="https://x4yl0n.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline decoration-gold-500 decoration-2 underline-offset-4 hover:text-forest-900">
          X4yl0n
        </a>
      </p>
      <p className="mt-1">© {new Date().getFullYear()} SECRET SANTA. Všetky práva vyhradené.</p>
    </footer>
  );
}
