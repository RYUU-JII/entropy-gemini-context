// src/ui-kit/hooks/useMouseTracker.js
import { useEffect } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

/**
 * 전역 마우스 좌표를 추적하는 신경망 훅
 * 리렌더링 없이 MotionValue로만 값을 전달하여 극강의 퍼포먼스를 유지합니다.
 */
export function useMouseTracker() {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // 수은 질감을 위한 묵직한 스프링 설정
    const springConfig = { stiffness: 50, damping: 30, restDelta: 0.001 };
    const smoothX = useSpring(mouseX, springConfig);
    const smoothY = useSpring(mouseY, springConfig);

    useEffect(() => {
        const updateMouse = (e) => {
            // 화면 중앙을 0,0으로 설정 (유물 배치가 중앙 기준이므로)
            mouseX.set(e.clientX - window.innerWidth / 2);
            mouseY.set(e.clientY - window.innerHeight / 2);
        };

        window.addEventListener('mousemove', updateMouse);
        return () => window.removeEventListener('mousemove', updateMouse);
    }, [mouseX, mouseY]);

    return { mouseX: smoothX, mouseY: smoothY };
}
