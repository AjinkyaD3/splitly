import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { FEATURES, STEPS } from "@/lib/landing";

export default function LandingPage() {
  return (
    <div className="flex flex-col pt-16">
      {/* ───── Hero ───── */}
      {/* ───── Hero ───── */}
      <section className="mt-20 pb-16 space-y-12 md:space-y-16 px-5 text-center">
        <div className="container mx-auto px-4 md:px-6 space-y-8">
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-800 border-amber-200 px-4 py-1 text-sm rounded-full"
          >
            Split expenses. Stay friends.
          </Badge>

          <h1 className="gradient-title mx-auto max-w-5xl text-5xl font-extrabold tracking-tight md:text-7xl leading-[1.15]">
            Shared bills, settled without the awkwardness
          </h1>

          <p className="mx-auto max-w-[780px] text-gray-700 md:text-xl/relaxed leading-relaxed font-medium">
            Splitly keeps every dinner, trip, and roommate bill transparent.
            Log who paid, share the cost fairly, and settle up in a couple of taps.
          </p>

          <div className="flex flex-col items-center gap-6 sm:flex-row justify-center pt-4">
            <Button
              asChild
              size="lg"
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 h-14 text-lg shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5"
            >
              <Link href="/dashboard">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-2 border-amber-200 text-amber-900 hover:bg-amber-50 hover:border-amber-300 font-semibold px-8 h-14 text-lg"
            >
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>
        </div>

        <div className="container mx-auto max-w-6xl overflow-hidden rounded-2xl shadow-2xl border border-gray-100">
          <div className="bg-gray-50 p-2 aspect-[16/9]">
            <Image
              src="/hero.png"
              width={1280}
              height={720}
              alt="Banner"
              className="rounded-xl mx-auto shadow-sm"
              priority
            />
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="bg-white py-24">
        <div className="container mx-auto px-4 md:px-6 text-center space-y-4">
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-800 border-amber-200"
          >
            Why Splitly
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl text-gray-900">
            Everything you need to keep costs fair
          </h2>
          <p className="mx-auto mt-4 max-w-[720px] text-gray-600 md:text-xl/relaxed">
            No more messy spreadsheets or group chats. Splitly keeps every share
            clear, from the first purchase to the final settlement.
          </p>

          <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ title, Icon, bg, color, description }) => (
              <Card
                key={title}
                className="flex flex-col items-center space-y-4 p-8 text-center border border-gray-100 shadow-md hover:shadow-lg transition-shadow rounded-2xl"
              >
                <div className={`rounded-full p-4 ${bg}`}>
                  <Icon className={`h-8 w-8 ${color}`} />
                </div>

                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="text-gray-600 leading-relaxed">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How it works ───── */}
      <section id="how-it-works" className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6 text-center space-y-4">
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-800 border-amber-200"
          >
            How it works
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl text-gray-900">
            From payment to payoff, in three steps
          </h2>
          <p className="mx-auto mt-4 max-w-[720px] text-gray-600 md:text-xl/relaxed">
            Capture the expense, choose how to split, and let Splitly keep track
            until everyone is square.
          </p>

          <div className="mx-auto mt-16 grid max-w-5xl gap-12 md:grid-cols-3">
            {STEPS.map(({ label, title, description }) => (
              <div key={label} className="flex flex-col items-center space-y-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-2xl font-bold text-white shadow-lg shadow-amber-500/20">
                  {label}
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
                <p className="text-gray-600 text-center text-lg leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Call‑to‑Action ───── */}
      <section className="py-24 gradient relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 text-center space-y-6">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">
            Ready to make “who owes what” crystal clear?
          </h2>
          <p className="mx-auto max-w-[640px] text-amber-50 md:text-xl/relaxed">
            Join thousands using Splitly to settle trips, rent, and every shared tab
            without friction.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white text-foreground hover:opacity-90 font-semibold"
          >
            <Link href="/dashboard">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="border-t bg-gray-50 py-12 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Splitly. All rights reserved.
      </footer>
    </div>
  );
}
