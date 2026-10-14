import { useId, useMemo, useState } from 'react';

const signalForms = [
    { name: '청록색의 넓은 파동', background: '#151e25', edge: '#233b42', light: '#a7dee0', end: '#283f49', center: 480, width: 174, frequency: 0.16, phase: 0, amplitude: 104, drift: 0.075 },
    { name: '보랏빛의 겹쳐진 파동', background: '#211a2c', edge: '#44304e', light: '#dbb0f1', end: '#3a2c47', center: 440, width: 218, frequency: 0.24, phase: 1.1, amplitude: 86, drift: 0.13 },
    { name: '산호빛의 비대칭 파동', background: '#261d1b', edge: '#4c302a', light: '#f5b77d', end: '#48362b', center: 530, width: 145, frequency: 0.11, phase: 2.3, amplitude: 133, drift: 0.045 },
    { name: '연두빛의 촘촘한 파동', background: '#1b231d', edge: '#344533', light: '#c9e3a4', end: '#2f443c', center: 480, width: 248, frequency: 0.29, phase: 0.65, amplitude: 76, drift: 0.18 },
];

export default function SignalArtwork({ variant }) {
    const id = useId().replaceAll(':', '');
    const [signalIndex, setSignalIndex] = useState(variant === 'warm' ? 2 : 0);
    const form = signalForms[signalIndex];
    const paths = useMemo(() => Array.from({ length: 80 }, (_, row) => {
        const samples = [];
        for (let column = 0; column <= 130; column += 1) {
            const x = 80 + column * 6.15;
            const envelope = Math.exp(-(((x - form.center) / form.width) ** 2));
            const wave = Math.sin(column * form.frequency + row * form.drift + form.phase)
                * Math.cos(row * 0.1 + form.phase * 0.3) * form.amplitude * envelope;
            const y = 112 + row * 4.4 + wave;
            samples.push(`${column === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
        }
        return samples.join(' ');
    }), [form]);

    return (
        <div className="feed-art-signal feed-art-frame" style={{ '--feed-art-signal-control-color': form.light }}>
            <div className="feed-art-signal-decoration" aria-hidden="true">
                <svg className="feed-art-svg" viewBox="0 0 960 600" focusable="false">
                    <defs><linearGradient id={`${id}-signal`} x2="1" y2="0"><stop stopColor={form.edge} /><stop offset="0.48" stopColor={form.light} /><stop offset="1" stopColor={form.end} /></linearGradient></defs>
                    <rect width="960" height="600" fill={form.background} />
                    <g fill="none" stroke={`url(#${id}-signal)`} strokeWidth="1">{paths.map((path, index) => <path key={index} d={path} opacity={0.36 + index / 150} />)}</g>
                    <path d="M80 503 H880 M80 500 V506 M880 500 V506 M480 500 V506" fill="none" stroke="#a2b7b8" strokeWidth="0.6" opacity="0.4" />
                </svg>
            </div>
            <button className="feed-art-remix feed-art-signal-next" type="button" onClick={() => setSignalIndex(value => (value + 1) % signalForms.length)}>다음 신호 <span aria-hidden="true">↗</span></button>
            <span className="feed-media-description" role="status" aria-live="polite" aria-atomic="true">신호 {signalIndex + 1}. {form.name}.</span>
        </div>
    );
}
