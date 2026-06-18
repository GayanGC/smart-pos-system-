/**
 * @file LoadingSpinner.jsx
 * Reusable animated spinner used during async operations and route loading.
 */

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
    xl: 'w-16 h-16 border-4',
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`
        ${sizes[size] || sizes.md}
        rounded-full border-slate-700 border-t-violet-500
        animate-spin ${className}
      `}
    />
  )
}
