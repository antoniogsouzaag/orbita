"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Liquid glass adaptado à Órbita: só o vidro (desfoque, distorção e brilho nas bordas internas).
 * Mantém os raios e tamanhos do Button da Órbita. O filtro SVG fica uma única vez no app (<GlassFilter />).
 */
const liquidVariants = cva(
  "liquid inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[transform,filter] duration-200 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        default: "text-fg",
        light: "text-white",
        accent: "text-accent",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-9",
      },
    },
    defaultVariants: { tone: "default", size: "md" },
  },
);

export function LiquidButton({ className, tone, size, asChild, children, ...props }: React.ComponentProps<"button"> & VariantProps<typeof liquidVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp data-slot="liquid-button" className={cn(liquidVariants({ tone, size }), className)} {...props}>
      <span aria-hidden className="liquid-distort pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]" />
      {children}
    </Comp>
  );
}

/** Filtro SVG usado pelo vidro (distorção leve). Renderizar uma vez por página. */
export function GlassFilter() {
  return (
    <svg aria-hidden className="pointer-events-none absolute size-0 overflow-hidden">
      <defs>
        <filter id="orbita-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="40" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="2" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

export { liquidVariants };
