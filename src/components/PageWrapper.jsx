import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

export function AnimatedPage({ children, className = "" }) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className={`space-y-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({ children, className = "" }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">{title}</h1>
        {subtitle && <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </motion.div>
  );
}

export function StatCard({ icon: Icon, label, value, color = "text-orange-400", bg = "bg-orange-500/10" }) {
  return (
    <motion.div variants={fadeUp} className="p-4 rounded-2xl bg-zinc-900/60 border border-white/[0.05] hover:border-white/10 transition-all">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </motion.div>
  );
}

export function DarkCard({ children, className = "" }) {
  return (
    <motion.div variants={fadeUp} className={`rounded-2xl bg-zinc-900/60 border border-white/[0.05] ${className}`}>
      {children}
    </motion.div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
        <p className="text-zinc-500 text-sm">Carregando...</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-zinc-600" />
      </div>
      <p className="text-zinc-400 font-medium">{message}</p>
      {sub && <p className="text-zinc-600 text-sm mt-1">{sub}</p>}
    </div>
  );
}

export function StatusPill({ status }) {
  const cfg = {
    ativo: "bg-green-500/10 text-green-400 border-green-500/20",
    pendente: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    excluido: "bg-red-500/10 text-red-400 border-red-500/20",
    ativa: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cfg[status] || cfg.pendente}`}>
      {status?.toUpperCase()}
    </span>
  );
}