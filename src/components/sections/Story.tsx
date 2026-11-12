"use client";

import { motion } from "motion/react";
import { photoById, story } from "@/content";
import type { StoryBlock } from "@/content/types";
import { useLang } from "@/lib/i18n";
import { ease } from "@/lib/motion";
import ArchivalImage from "../ArchivalImage";
import { LeafSprig } from "../Botanical";
import { useLightbox } from "../Lightbox";
import { Container, Item, PlaceholderTag, Reveal, SectionIntro, cn } from "../ui";

function Chapter({ block }: { block: Extract<StoryBlock, { kind: "chapter" }> }) {
  const { l } = useLang();
  const { open } = useLightbox();
  const pics = block.photoIds.map((id) => photoById(id)!).filter(Boolean);
  const imageFirst = block.side === "start";

  return (
    <article aria-labelledby={`ch-${block.id}`} className="grid items-center gap-x-8 gap-y-10 md:grid-cols-12">
      <div className={cn("relative md:col-span-6", imageFirst ? "md:order-1" : "md:order-2 md:col-start-7")}>
        <button type="button" onClick={() => open(pics, 0)} className="group block w-full cursor-zoom-in text-start" aria-label={l(pics[0].alt)}>
          <ArchivalImage photo={pics[0]} mount maxVh={70} className={cn("transition-transform duration-700 group-hover:-translate-y-1", pics.length > 1 && "w-[82%]", !imageFirst && "md:ms-auto")} />
        </button>
        {pics[1] && (
          <button
            type="button"
            onClick={() => open(pics, 1)}
            aria-label={l(pics[1].alt)}
            className="absolute -bottom-10 end-0 w-[42%] cursor-zoom-in bg-white p-2 pb-5 shadow-[var(--shadow-lift)] transition-transform duration-700 hover:-translate-y-1"
            style={{ rotate: "2deg" }}
          >
            <ArchivalImage photo={pics[1]} labelled={false} className="[&>div]:shadow-none" />
          </button>
        )}
      </div>

      <Reveal className={cn("flex flex-col gap-5 md:col-span-5", imageFirst ? "md:order-2 md:col-start-8" : "md:order-1 md:col-start-1")}>
        <Item className="flex items-baseline gap-4">
          <span className="font-display text-6xl font-light leading-none text-dusty/70 tabular-nums">{String(block.number).padStart(2, "0")}</span>
          <span className="label">{l(block.kicker)}</span>
        </Item>
        <Item as="h3" className="text-[clamp(2rem,3.6vw,3rem)] font-light leading-tight text-burgundy">
          <span id={`ch-${block.id}`}>{l(block.title)}</span>
        </Item>
        {block.body.map((p, i) => (
          <Item as="p" key={i} className="max-w-[34rem] text-[1.08rem] leading-[1.9] text-charcoal/85">
            {l(p)}
          </Item>
        ))}
        {block.placeholder && (
          <Item>
            <PlaceholderTag />
          </Item>
        )}
      </Reveal>
    </article>
  );
}

function Quote({ block }: { block: Extract<StoryBlock, { kind: "quote" }> }) {
  const { l } = useLang();
  return (
    <figure className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 py-6 text-center">
      <LeafSprig className="w-44 text-sage" />
      <motion.blockquote
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 1.2, ease }}
        className="font-display text-[clamp(1.9rem,4.4vw,3.6rem)] font-light leading-[1.25] text-burgundy"
      >
        <span aria-hidden className="text-dusty">“</span>
        {l(block.text)}
        <span aria-hidden className="text-dusty">”</span>
      </motion.blockquote>
      {block.attribution && <figcaption className="font-hand text-2xl text-rose">{l(block.attribution)}</figcaption>}
      {block.placeholder && <PlaceholderTag />}
    </figure>
  );
}

function FullPhoto({ block }: { block: Extract<StoryBlock, { kind: "photo" }> }) {
  const { l } = useLang();
  const { open } = useLightbox();
  const photo = photoById(block.photoId)!;
  return (
    <figure className="flex flex-col gap-4">
      <button type="button" onClick={() => open([photo], 0)} aria-label={l(photo.alt)} className="block w-full cursor-zoom-in">
        <ArchivalImage photo={photo} sizes="96vw" maxVh={76} className="mx-auto" />
      </button>
      <figcaption className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <span className="font-display text-base text-charcoal/80">{l(photo.caption)}</span>
        {photo.placeholder && <PlaceholderTag short />}
      </figcaption>
    </figure>
  );
}

export default function Story() {
  const { t } = useLang();
  return (
    <section id="story" aria-labelledby="story-title" className="py-[var(--spacing-section)]">
      <Container>
        <SectionIntro id="story-title" eyebrow={t.story.eyebrow} title={t.story.title} lead={t.story.lead} layout="split" />
      </Container>
      <div className="mt-[clamp(4rem,8vw,7rem)] flex flex-col gap-[clamp(5rem,10vw,9rem)]">
        {story.map((block) =>
          block.kind === "photo" ? (
            <Container key={block.id} wide>
              <FullPhoto block={block} />
            </Container>
          ) : block.kind === "quote" ? (
            <Container key={block.id}>
              <Quote block={block} />
            </Container>
          ) : (
            <Container key={block.id}>
              <Chapter block={block} />
            </Container>
          )
        )}
      </div>
    </section>
  );
}
