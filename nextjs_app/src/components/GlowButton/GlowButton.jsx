import React from 'react';
import { useRouter } from 'next/navigation';
import './GlowButton.scss';

const GlowButton = ({ text = "←", onClick, className = "" }) => {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push('/');
    }
  };

  return (
    <button 
      className={`button-40 ${className}`} 
      role="button"
      onClick={handleClick}
    >
      <span className="text">{text}</span>
    </button>
  );
};

export default GlowButton;
