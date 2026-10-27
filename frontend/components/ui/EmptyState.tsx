import Link from 'next/link';

export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <div className="surface-card px-6 py-14 text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[20px] bg-[#eeedff] text-[24px] text-[#7b78ff]">✦</div><h2 className="text-[18px] font-extrabold text-[#1c1b29]">{title}</h2><p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-5 text-[#6d6a82]">{description}</p>{href && action ? <Link href={href} className="mt-5 inline-flex rounded-full bg-[#7b78ff] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#6763eb]">{action}</Link> : null}</div>;
}
