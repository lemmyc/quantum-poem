'use client';

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import './homePage.css'

const LanguageSelector = () => {
  const router = useRouter()
  const [showPopup, setShowPopup] = useState(false)
  const [currentPoem, setCurrentPoem] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState('')
  const typingIntervalRef = useRef(null)
  const [h1Text, setH1Text] = useState('Select a language')
  const [showH1Effect, setShowH1Effect] = useState(false)
  const [isFlying, setIsFlying] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')

  const poems = {
    vi: `Trăng lên đỉnh núi trăng tàn\nĐêm khuya lặng lẽ trăng tan mây mờ\nTrăng soi bóng nước trăng mơ\nTrăng về trăng nhớ trăng chờ trăng thương`,
    en: `In the quantum realm of dreams\nWhere time and space entwine\nWords dance like particles\nIn patterns divine`,
    ja: `星の海に\n浮かぶ月影\n静かな夜`
  }

  const handleLanguageSelect = (language) => {
    setSelectedLanguage(language)
    setH1Text('Enter your word')
    setShowH1Effect(true)
    setIsFlying(true)
    setTimeout(() => {
      setShowInput(true)
      setIsFlying(false)
      setShowH1Effect(false)
    }, 800)
  }

  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      router.push(`/feature?word=${encodeURIComponent(inputValue)}&language=${selectedLanguage}`)
    }
  }

  const startTyping = (language) => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
    }
    setActiveLanguage(language)
    setShowPopup(true)
    setIsTyping(true)
    setCurrentPoem('')
    const poem = poems[language]
    let currentIndex = 0
    typingIntervalRef.current = setInterval(() => {
      setCurrentPoem(() => {
        const next = poem.slice(0, currentIndex + 1)
        currentIndex++
        if (currentIndex >= poem.length) {
          clearInterval(typingIntervalRef.current)
          setIsTyping(false)
        }
        return next
      })
    }, 50)
  }

  const handleMouseEnter = (language) => {
    if (activeLanguage !== language) {
      startTyping(language)
    }
  }

  const handleMouseLeave = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
    }
    setShowPopup(false)
    setCurrentPoem('')
    setIsTyping(false)
    setActiveLanguage(null)
  }

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="language-selector">
      <video autoPlay loop muted className="background-video">
        <source src="/bg.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {!showInput && (
        <div className={`selector-content${isFlying ? ' fly-up' : ''}`}>
          <h1 className={showH1Effect ? 'h1-appear' : ''}>{h1Text}</h1>
          <div className="language-options">
            <button 
              onClick={() => handleLanguageSelect('en')}
              onMouseEnter={() => handleMouseEnter('en')}
              onMouseLeave={handleMouseLeave}
            >
              English
            </button>
            <button 
              onClick={() => handleLanguageSelect('vi')}
              onMouseEnter={() => handleMouseEnter('vi')}
              onMouseLeave={handleMouseLeave}
            >
              Tiếng Việt
            </button>
            <button 
              onClick={() => handleLanguageSelect('ja')}
              onMouseEnter={() => handleMouseEnter('ja')}
              onMouseLeave={handleMouseLeave}
            >
              日本語
            </button>
          </div>
        </div>
      )}
      {showInput && (
        <div className="center-input">
          <div className="input-wrapper">
            <input
              type="text"
              placeholder="Enter your word"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInputSubmit()}
            />
            <span className="input-icon" onClick={handleInputSubmit} tabIndex={0}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </div>
        </div>
      )}
      {showPopup && (
        <div className="poem-popup poem-popup-top">
          <div className="poem-content">
            <pre className={isTyping ? 'typing' : ''}>
              {currentPoem}
              {isTyping && <span className="cursor">|</span>}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default LanguageSelector