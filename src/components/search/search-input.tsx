"use client";

import { useId, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function SearchInput({
  paramName = "q",
  placeholder,
  label,
  debounceMs = 200,
}: {
  paramName?: string;
  placeholder: string;
  label: string;
  debounceMs?: number;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentValue = searchParams.get(paramName) ?? "";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const navigate = useCallback(
    (raw: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (raw.trim()) {
        params.set(paramName, raw.trim());
      } else {
        params.delete(paramName);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams, paramName],
  );

  function handleChange(raw: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => navigate(raw), debounceMs);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        defaultValue={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
      />
    </div>
  );
}
