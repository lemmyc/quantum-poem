import { useEffect, useState } from 'react';
import styles from './Top.module.scss';
import './TitleHeader.scss';
import './Slogan.scss';

const Top = () => {
  const [locationGranted, setLocationGranted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    const stored = sessionStorage.getItem('user_location');
    if (stored) {
      setLocationGranted(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        sessionStorage.setItem(
          'user_location',
          JSON.stringify({ latitude, longitude })
        );
        setLocationGranted(true);
      },
      (error) => {
        console.error('Location permission denied:', error);
        setLocationGranted(false);
      }
    );
  }, []);

  const handleScroll = () => {
    if (!locationGranted) {
      alert('Please allow location access to proceed.');
      return;
    }

    const targetPosition = 700;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    const duration = 1400;
    let start = null;

    function animation(currentTime) {
      if (start === null) start = currentTime;
      const timeElapsed = currentTime - start;
      const progress = Math.min(timeElapsed / duration, 1);

      const easeInOutCubic = (p) =>
        p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      window.scrollTo(0, startPosition + distance * easeInOutCubic(progress));

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      }
    }

    requestAnimationFrame(animation);
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo + ' title_header'}>
        {/* Logo content */}
      </div>

      <main className={styles.main}>
        <section className={styles.content}>
          <h1 className={styles.title + ' text_slogan'}>
            "Where art and quantum intersect."
          </h1>
          <p className={styles.description}>
            A poetic experiment where quantum concepts and human emotions intertwine...
          </p>
          <div className={styles.buttonGroup}>
            <button className={styles.trialButton} onClick={handleScroll}>
              Get Started
            </button>
          </div>
        </section>

        <section className={styles.imageContainer}>
          <img
            alt="3D Shape"
            className={styles.image}
            height="320"
            src="./assets/3D_shape.png"
            width="320"
          />
        </section>
      </main>
    </div>
  );
};

export default Top;
