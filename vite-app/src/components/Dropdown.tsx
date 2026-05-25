import { useState, useRef, useEffect } from 'react';

export interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Dropdown({ trigger, children, disabled = false }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="btn ghost"
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {trigger}
        <span style={{ fontSize: 10, marginLeft: 2 }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            minWidth: 160,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface DropdownItemProps {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function DropdownItem({ onClick, children, disabled = false }: DropdownItemProps) {
  return (
    <button
      onClick={() => onClick?.()}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        padding: '10px 16px',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        color: disabled ? 'var(--ink-3)' : 'var(--ink)',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.target as HTMLElement).style.background = 'var(--surface-2)';
        }
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.background = 'none';
      }}
    >
      {children}
    </button>
  );
}
