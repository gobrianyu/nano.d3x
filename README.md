# Poké.d3x

Poké.d3x (or nano.d3x) is a visual artist portfolio formatted as a grid gallery web experience.

Built to showcase Pokémon illustrations by [**@nano.m0n**](https://www.instagram.com/nano.m0n/).

## Features

- Recursive, tree-based visualisation of evolutionary paths, alongside other species data such as base stats, height, weight, and dex entries.
- Displays for regional variants, gimmick forms (Mega, Gigantamax), and gender-specific specimens. Every Pokemon is properly documented.
- Carousel-style details gallery with support for swipe gestures, keyboard shortcuts, and navigation logic to maintain context.
- Multi-layered filtering and search by name, dex number, region, and type; enabled by a caching system designed to handle thousands of images and data files.
- Shiny/Classic and Dark/Light toggles for different illustrations and visual modes.

## Tech Stack

- **Framework**: React 18+ with Vite
- **Data Orchestration**: @tanstack/react-query for high-performance caching and stale-while-revalidate data fetching.
- **Animations**: motion/react (Framer Motion)
- **Styling**: Tailwind CSS
- **Typography**: Space Grotesk, Inter

## Metadata & Credits

- **Artist**: @nano.m0n
- **Disclaimer**: Pokémon is a trademark of Nintendo, Creatures Inc., and GAME FREAK. This project is a non-commercial fan-centric portfolio.
