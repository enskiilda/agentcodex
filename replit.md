# Overview

This is a Next.js application that demonstrates an AI-powered computer automation agent using Mistral AI's medium model. The application allows users to interact with a virtual desktop environment where the AI agent can perform tasks like browsing websites, clicking elements, typing text, and taking screenshots through natural language commands. The interface provides real-time streaming of AI responses and visual feedback of the desktop state.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: Next.js 15.2.1 with React 19 and TypeScript
- **Rendering Strategy**: Client-side rendering with React Server Components enabled (`rsc: true`)
- **Styling**: Tailwind CSS v4 with custom theme configuration and shadcn/ui component library
- **State Management**: Custom realtime session management using external store synchronization pattern
- **UI Components**: Radix UI primitives for accessible, unstyled components (Dialog, Label, Slot, Tooltip)

**Key Design Patterns**:
- **Realtime Session Pattern**: The `RealtimeSession` class manages bidirectional streaming communication with the backend API, maintaining message state, input state, and connection status
- **External Store Sync**: Uses `useSyncExternalStore` for efficient state updates without prop drilling
- **Scroll Management**: Custom `useScrollToBottom` hook with MutationObserver for automatic scrolling as new messages arrive
- **Component Composition**: Leverages Radix UI's composition model for building accessible, customizable UI components

## Backend Architecture

**API Routes**: Next.js API routes with Node.js runtime
- **Streaming Architecture**: Server-sent events for real-time AI response streaming
- **Long-Running Processes**: Configured with `maxDuration: 3600` seconds for extended AI operations
- **Dynamic Rendering**: Force-dynamic rendering with cache revalidation disabled for real-time interactions

**AI Integration**:
- **LLM Provider**: Mistral AI using the `mistral-medium-2508` model
- **Tool Use Pattern**: Computer control capabilities through structured tool invocations (screenshot, mouse, keyboard actions)
- **System Instructions**: Detailed prompt engineering for proactive task execution with Polish language support

**Desktop Automation**:
- **Sandbox Provider**: OnKernel browser-as-a-service for isolated browser automation
- **Computer Controls**: OnKernel Computer Controls API for browser automation (screenshot, mouse clicks, keyboard input, scrolling, drag operations)
- **Process Execution**: OnKernel Process API for running bash commands with base64-encoded stdout/stderr
- **Resolution**: Fixed 1024x768 (4:3 aspect ratio) for consistent visual processing
- **Session Management**: Browser session reconnection support with ID-based session persistence
- **Lifecycle**: Browser session management with manual kill endpoint for resource cleanup
- **API Authentication**: Hardcoded API key for OnKernel services (sk_85dd38ea-b33f-45b5-bc33-0eed2357683a.t2lQgq3Lb6DamEGhcLiUgPa1jlx+1zD4BwAdchRHYgA)

## External Dependencies

**Third-Party Services**:
- **Mistral AI API**: Primary LLM service for natural language understanding and computer control reasoning
- **OnKernel API**: Cloud-based browser infrastructure for safe browser automation and desktop control with WebRTC/VNC streaming

**Key NPM Packages**:
- **AI/ML**: `@mistralai/mistralai` (v1.10.0) for LLM integration, `openai` (v6.3.0) as alternative client
- **Desktop Control**: `@onkernel/sdk` for browser-as-a-service management
- **UI Framework**: `next` (15.2.1), `react` (19.0.0), `react-dom` (19.0.0)
- **Styling**: `tailwindcss` (v4), `tailwindcss-animate`, `@tailwindcss/typography`
- **Component Libraries**: `@radix-ui` components, `lucide-react` for icons
- **Utilities**: `class-variance-authority`, `clsx`, `tailwind-merge` for styling utilities
- **Markdown**: `react-markdown` with `remark-gfm` for formatted message rendering
- **Animation**: `motion` (v12.4.10) for UI animations
- **Analytics**: `@vercel/analytics` for usage tracking
- **Notifications**: `sonner` for toast notifications

**Notable Configuration**:
- Custom font loading with Inter font family
- Image optimization disabled (`unoptimized: true`)
- Package import optimization for lucide-react and Radix UI components
- TypeScript strict mode enabled with ES2017 target
- React strict mode disabled for compatibility
- CSP headers configured to allow all domains in iframe (`frame-src *; frame-ancestors *;`)
- Iframe sandbox attributes configured for full browser functionality