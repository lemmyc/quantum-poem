import styles from './Top.module.scss';
import './TitleHeader.scss';
import './Slogan.scss';

const Top = () => {
  const handleScroll = () => {
    const targetPosition = 700;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    const duration = 1400; 
    let start = null;

    function animation(currentTime) {
      if (start === null) start = currentTime;
      const timeElapsed = currentTime - start;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeInOutCubic = progress => {
        return progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      };

      window.scrollTo(0, startPosition + distance * easeInOutCubic(progress));

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      }
    }

    requestAnimationFrame(animation);
  };

  return (
    <>
      {/* <header className={styles.header}> */}
        <div className={styles.logo + " title_header"}>
          <span className="ch1">Q</span>
          <span className="ch2">U</span>
          <span className="ch3">A</span>
          <span className="ch4">N</span>
          <span className="ch5">T</span>
          <span className="ch6">U</span>
          <span className="ch7">M</span>
          <span className="ch8"> </span>
          <span className="ch9">P</span>
          <span className="ch10">O</span>
          <span className="ch11">E</span>
          <span className="ch12">T</span>
          <span className="ch13">R</span>
          <span className="ch14">Y</span>
        </div>
      {/* </header> */}
      <main className={styles.main}>
        <section className={styles.content}>
          <h1 className={styles.title + " text_slogan"}>
            "Where art and quantum intersect."
          </h1>

          <p className={styles.description}>
            A poetic experiment where quantum concepts and human emotions intertwine — crafting verses that reveal the beauty, mystery, and creativity of a universe in flux.
          </p>
          <div className={styles.buttonGroup}>
            <button 
              className={styles.trialButton} 
              type="button"
              onClick={handleScroll}
            >
              Get Started
            </button>
          </div>
        </section>
        <section className={styles.imageContainer}>
          <img
            alt="3D blue metallic spiral shape with glowing edges on black background"
            className={styles.image}
            height="320"
            src="./assets/3D_Shape.png"
            width="320"
          />
        </section>
      </main>
    </>
  );
};

export default Top; 