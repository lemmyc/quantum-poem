'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './style.module.scss';
import Titles from './titles';
import Descriptions from './descriptions';
import { Modal } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';

const data = [
    {
        title: "JAPANESE",
        description: "春の雨 \n 静かに降る \n 花を濡らす",
        speed: 0.5,
        code: "ja"
    },
    {
        title: "VIETNAMESE",
        description: "Mặt trời lên tỏa nắng hồng,\nCánh chim bay lượn giữa dòng gió thơm.",
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
]

export default function Projects() {
    const router = useRouter();
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [inputValue, setInputValue] = useState('');

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
    };

    const handleCancel = () => {
        setShowModal(false);
        setInputValue('');
    };

    const handleArrowClick = () => {
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
                        type="text"
                        className={styles.input}
                        placeholder="Input your topic"
                        value={inputValue}
                        onChange={handleInputChange}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleArrowClick(); }}
                    />
                    <ArrowRightOutlined 
                        className={styles.arrowIcon} 
                        onClick={handleArrowClick}
                    />
                </div>
            </Modal>
        </div>
    )
}

