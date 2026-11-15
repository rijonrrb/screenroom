# SCREENROOM

**A movie-and-series discovery and playback project combining a curated catalog, content management, and a modern viewing experience.**

[Live Website](https://screenroom.devrijonn.com/)
## Overview

SCREENROOM is an independent full-stack web application for browsing, organizing, and playing authorized movies and series. It connects a responsive audience-facing catalog to a dedicated content-management experience and an integrated video player.

**The problem it explores:** A streaming experience involves more than playing a video. Viewers need to discover titles, understand what they are watching, and navigate series and episodes. Content managers need a practical way to structure metadata, publication states, and media sources. SCREENROOM brings these concerns into a cohesive product.

**Who it's for:** viewers exploring a curated media collection, and developers or content managers interested in the design of modern media platforms.

## What SCREENROOM brings together

### Viewing experience

- **Movie and series browsing:** a responsive catalog with title discovery and search.
- **Rich title details:** posters, backdrops, synopses, genres, and related information.
- **Episodic navigation:** support for seasons and episode-level information.
- **Integrated playback:** [SecureStream Player](https://github.com/rijonrrb/SecureStream-Player) for compatible video sources and source-dependent playback options.
- **Cross-device design:** a viewing interface intended for both desktop and mobile browsers.

### Content management

- **Content Studio:** an authenticated administrative interface for managing titles and related content.
- **Publication workflow:** draft and published states to help organize the catalog.
- **Metadata integration:** TMDB-powered title discovery and metadata import, with editorial control over catalog entries.
- **Media association:** attach permitted video sources to films and episodes.
- **API-backed platform:** a Node.js/Express service and relational data model support the public site and management tools.

> **Project status: Active development.** The repository includes the catalog frontend, backend, Studio, and player integrations. Some media formats, provider integrations, and cross-browser playback paths still require configuration or validation. Listing a source does not guarantee playback on every device.

## Why I built it

SCREENROOM is a practical exploration of the end-to-end work behind a media product—from interface design and catalog modeling to backend operations and playback integration.

It also demonstrates a modular engineering approach: the playback experience uses **SecureStream Player**, a separate reusable open-source project, rather than coupling all video logic to this one application.

## Technology

**Frontend:** JavaScript, HTML, and CSS for the responsive viewing experience.

**Backend and data:** Node.js, Express, and MariaDB.

**Media and metadata:** SecureStream Player, TMDB, and Cloudflare R2-compatible media storage for authorized content.

## Future direction

Current improvement areas include:

- More consistent playback across mobile browsers and media formats.
- Better multi-language audio, subtitles, and viewing controls.
- Richer search, discovery, and content organization.
- More refined administrative workflows and playback reliability.

These items describe ongoing priorities, **not a claim that every feature is already available**.

## Feedback and contributions

Suggestions and focused improvements are welcome. Use [GitHub Issues](https://github.com/rijonrrb/screenroom/issues) for bugs, usability ideas, and proposals. Contributors can fork the repository and open a [pull request](https://github.com/rijonrrb/screenroom/pulls) describing changes and relevant testing.

Please do not include private credentials, unpublished media, or internal operational information in contributions.

## Content rights and attribution

SCREENROOM is a personal software project, **not a source of licensed commercial movies or series**. Only content with appropriate rights should be uploaded, linked, or streamed. TMDB provides metadata, not video files.

*This product uses the TMDB API but is not endorsed or certified by TMDB.*
