import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { TextEffect } from '@/components/ui/text-effect'
import { cn } from '@/lib/utils'

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: 'blur(12px)',
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        type: 'spring',
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
}

export function HeroSection() {
  return (
    <>
      <HeroHeader />
      <main className="overflow-hidden">
        <section>
          <div className="relative pt-24 md:pt-36">
            {/* Background gradient */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_10%,transparent_40%,hsl(var(--primary))_100%)]"
            />
            <div className="absolute inset-x-0 top-56 -z-10 h-24 rotate-12 bg-primary/10 blur-3xl" />

            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                <AnimatedGroup preset="slide">
                  <Link
                    to="#"
                    className="hover:bg-muted mx-auto flex w-fit items-center gap-4 rounded-full border px-2 py-1 text-sm shadow-md shadow-primary/5 transition-colors"
                  >
                    <span className="bg-muted text-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                      ✨ Introducing Support for AI Models
                    </span>
                    <span className="flex items-center gap-2 text-sm">
                      Explore the Docs
                      <ArrowRight className="size-3" />
                    </span>
                  </Link>

                  <TextEffect
                    preset="blur"
                    as="h1"
                    className="mt-8 text-balance text-4xl font-bold md:text-7xl lg:mt-16 text-foreground"
                  >
                    Modern Solutions for Customer Engagement
                  </TextEffect>

                  <TextEffect
                    per="line"
                    as="p"
                    preset="fade"
                    delay={0.5}
                    className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground"
                  >
                    Highly customizable components for building modern websites and applications that look and feel the way you mean it.
                  </TextEffect>
                </AnimatedGroup>

                <AnimatedGroup
                  preset="blur"
                  className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row"
                >
                  <div key="cta-1">
                    <Button size="lg" className="rounded-xl px-5 text-base">
                      <span className="text-nowrap">Start Building</span>
                      <ArrowRight className="ml-1 size-4" />
                    </Button>
                  </div>
                  <div key="cta-2">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="rounded-xl px-5 text-base"
                    >
                      <span className="text-nowrap">Request a demo</span>
                    </Button>
                  </div>
                </AnimatedGroup>
              </div>

              <AnimatedGroup
                variants={{
                  container: {
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.05 },
                    },
                  },
                  item: transitionVariants.item,
                }}
                className="relative mx-auto mt-20 max-w-4xl"
              >
                <div className="rounded-2xl border bg-background/50 p-2 shadow-lg shadow-primary/5 ring-1 ring-border">
                  <img
                    className="aspect-[3/2] rounded-xl"
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80"
                    alt="Dashboard preview"
                  />
                </div>
              </AnimatedGroup>
            </div>
          </div>

          {/* Logos section */}
          <div className="mx-auto mt-20 max-w-7xl px-6 pb-16">
            <div className="flex flex-col items-center">
              <p className="text-muted-foreground font-medium">
                Meet Our Customers
              </p>
            </div>
            <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-50">
              <Logo className="h-5" />
              <Logo className="h-5" />
              <Logo className="h-5" />
              <Logo className="h-5" />
              <Logo className="h-5" />
              <Logo className="h-5" />
              <Logo className="h-5" />
              <Logo className="h-5" />
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

const menuItems = [
  { name: 'Features', href: '#link' },
  { name: 'Solution', href: '#link' },
  { name: 'Pricing', href: '#link' },
  { name: 'About', href: '#link' },
]

const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false)
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header>
      <nav
        data-state={isScrolled ? 'scrolled' : 'top'}
        className="fixed z-50 w-full px-2"
      >
        <div
          className={cn(
            'mx-auto mt-2 max-w-6xl rounded-2xl border px-6 py-3 transition-all duration-300 lg:px-12',
            isScrolled
              ? 'bg-background/80 backdrop-blur-lg shadow-lg'
              : 'bg-background/50 backdrop-blur-sm'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to="/" aria-label="home">
                <Logo className="h-7" />
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                {menuState ? (
                  <X className="size-5 text-foreground" />
                ) : (
                  <Menu className="size-5 text-foreground" />
                )}
              </button>
            </div>

            {/* Desktop nav */}
            <div className="hidden lg:block">
              <ul className="flex gap-8 text-sm">
                {menuItems.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground block duration-150"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mobile nav */}
            <div
              className={cn(
                'fixed inset-x-0 top-0 z-10 rounded-b-2xl border-b bg-background px-6 pb-6 pt-20 shadow-2xl shadow-primary/5 lg:hidden',
                menuState ? 'block' : 'hidden'
              )}
            >
              <ul className="space-y-6 text-base">
                {menuItems.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground block duration-150"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-12 flex w-full flex-col gap-3">
                <Button variant="outline" className="w-full">
                  Login
                </Button>
                <Button variant="outline" className="w-full">
                  Sign Up
                </Button>
                <Button className="w-full">
                  Get Started
                </Button>
              </div>
            </div>

            <div className="hidden lg:flex lg:items-center lg:gap-2">
              <Button variant="ghost" size="sm">
                Login
              </Button>
              <Button variant="outline" size="sm">
                Sign Up
              </Button>
              <Button size="sm">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

const Logo = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 120 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="28" height="28" rx="6" fill="currentColor" opacity="0.15" />
      <rect x="4" y="4" width="20" height="20" rx="4" fill="currentColor" opacity="0.3" />
      <text
        x="38"
        y="20"
        fill="currentColor"
        fontSize="18"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        VitraPay
      </text>
    </svg>
  )
}
