import Link from 'next/link';

export function EmptyState({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return <div className="px-6 py-16 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-[#d5d5d5] text-[20px]">◎</div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-[320px] text-[13px] leading-5 text-[#969696]">{description}</p>{href && action ? <Link href={href} className="mt-4 inline-flex rounded-full border border-[#0095f6] px-4 py-2 text-[13px] font-semibold text-[#0095f6] hover:bg-[#0095f6] hover:text-white">{action}</Link> : null}</div>;
}
