import React from 'react';

export default function Select({ value, onChange, className, children, ...props }) {
  return (
    <select className={className} value={value} onChange={onChange} {...props}>
      {children}
    </select>
  );
}
