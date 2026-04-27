# Changelog

## 1.5.7

### Patch Changes

- Security audit: align peer dependencies, standardize TypeScript ^5.8.3, fix CLI dynamic versioning

- Updated dependencies []:
  - @vaiftech/client@1.5.7
  - @vaiftech/auth@1.5.7

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-11

### Added

- VaifErrorBoundary component for graceful error handling
- Enhanced VaifContext with retry and error recovery
- Improved useMutation hook with optimistic update support
- Enhanced useStorage hook with upload progress callbacks

## [1.0.0] - 2026-01-17

### Added

- Initial stable release
- **VaifProvider** - React context provider for VAIF client
- **Authentication Hooks**
  - `useAuth` - Full authentication state and methods
  - `useUser` - Current user state
  - `useSession` - Session management
- **Data Hooks**
  - `useQuery` - Fetch data with automatic caching
  - `useMutation` - Create, update, delete operations
  - `useRealtime` - Subscribe to database changes
  - `useRealtimeQuery` - Query with realtime updates
- **Storage Hooks**
  - `useUpload` - File upload with progress
  - `useDownload` - File download with progress
  - `useFile` - File metadata and operations
  - `useFiles` - List files in bucket
  - `usePublicUrl` - Get public URL for files
- **Functions Hooks**
  - `useFunction` - Invoke edge functions
  - `useFunctionList` - List available functions
- **Features**
  - Automatic loading and error states
  - TypeScript generics for type safety
  - Optimistic updates support
  - Refetch utilities
