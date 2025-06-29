'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './style.module.scss';
import Titles from './titles';
import Descriptions from './descriptions';
import { Modal } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import badWords from '../../../data/badWords.json';

const data = [
    {
        title: "JAPANESE",
        description: "春の雨 \n 静かに降る \n 花を濡らす",
        speed: 0.5,
        code: "ja"
    },
    {
        title: "VIETNAMESE",
        description: "Mưa xuân khe khẽ,\n Rơi nhẹ trên cành hoa,\n Uớt đẫm hương thơm.",
        speed: 0.5,
        code: "vi"
    },
    {
        title: "KOREAN",
        description: "봄의 비 \n 조용히 내리는 \n 꽃을 젖히는",
        speed: 0.67,
        code: "ko"
    },
    {
        title: "ENGLISH",
        description: "Spring rain,\n softly falling, \n flowers soaking wet.",
        speed: 0.8,
        code: "en"
    }
    ,
    {
        title: "CHINESE",
        description: "🌸 春雨轻轻地下，\n 落在花枝上， \n 香气湿润弥漫。",
        speed: 0.9,
        code: "cn"
    }
]

export default function Projects() {
    const router = useRouter();
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);
    const [warning, setWarning] = useState('');

    useEffect(() => {
        if (showModal && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showModal]);

    const handleLanguageSelect = (index) => {
        const language = data[index].title;
        setSelectedLanguage(language);
        
        // Smooth scroll to top
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        // Wait for scroll animation to complete
        setTimeout(() => {
            setShowModal(true);
        }, 600);
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
        setWarning('');
    };

    const handleCancel = () => {
        setShowModal(false);
        setInputValue('');
    };

    const handleArrowClick = () => {
        const bannedWords = badWords.bannedWords;
        const isBadWord = bannedWords.some(word => inputValue.trim().toLowerCase().includes(word));
        if (isBadWord) {
            setWarning('Your input contains inappropriate words. Please try again.');
            return;
        }
        setWarning('');
        if (inputValue.trim() && selectedLanguage) {
            const languageCode = data.find(item => item.title === selectedLanguage)?.code || 'en';
            router.push(`/feature?word=${inputValue.trim()}&language=${languageCode}`);
        }
    };

    return (
        <div className={styles.container}>
            <Titles 
                data={data} 
                setSelectedProject={setSelectedProject}
                onLanguageSelect={handleLanguageSelect}
            />
            <Descriptions data={data} selectedProject={selectedProject}/>
            <Modal
                open={showModal}
                onCancel={handleCancel}
                footer={null}
                closable={false}
                maskClosable={true}
                centered
                className={styles.customModal}
            >
                <div className={styles.modalContent}>
                    <input
                        ref={inputRef}
                        type="text"
                        className={styles.input}
                        placeholder="Input your topic"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={e => { if (e.key === 'Enter') handleArrowClick(); }}
                    />
                    <ArrowRightOutlined 
                        className={styles.arrowIcon} 
                        onClick={handleArrowClick}
                    />
                    {warning && (
                        <div style={{ color: 'red', marginTop: 8, textAlign: 'center' }}>
                            {warning}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}

