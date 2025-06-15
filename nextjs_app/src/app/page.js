'use client';

import styles from './page.module.scss'
import React from 'react';
import dynamic from 'next/dynamic';
import SmoothScroll from '../components/LanguageSelector/smoothScroll';
import Projects from '../components/LanguageSelector/projects';
import Top from '../components/top/Top.jsx';

const Earth = dynamic(() => import('../components/LanguageSelector/earth'), {
  ssr: false,
  loading: () => (
    <div className={styles.earthPlaceholder}>
      <img src="/assets/placeholder.png" alt="Loading Earth" />
    </div>
  )
})

export default function Home() {
  return (
    <SmoothScroll>
      <Top/>  
      <main className={styles.main}>
        <Earth />
        <Projects />
      </main>
    </SmoothScroll>
  )
}
