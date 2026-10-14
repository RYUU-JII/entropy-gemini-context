import { memo } from 'react';
import CityArtwork from './artworks/CityArtwork.jsx';
import OrbitArtwork from './artworks/OrbitArtwork.jsx';
import GenerativeArtwork from './artworks/GenerativeArtwork.jsx';
import AmbientArtwork from './artworks/AmbientArtwork.jsx';
import SignalArtwork from './artworks/SignalArtwork.jsx';
import AlignmentArtwork from './artworks/AlignmentArtwork.jsx';
import SkyArtwork from './artworks/SkyArtwork.jsx';
import './media.css';

const artworkTypes = {
    alignment: AlignmentArtwork,
    city: CityArtwork,
    orbit: OrbitArtwork,
    generative: GenerativeArtwork,
    signal: SignalArtwork,
    landscape: AmbientArtwork,
    sky: SkyArtwork,
    typography: AmbientArtwork,
};

/** Presentation-only renderer. The feed content catalog owns artwork selection and descriptions. */
function PostMedia({ media, reducedMotion = false, interactive = true }) {
    if (!media || typeof media !== 'object') {
        throw new Error('Feed artwork requires a media descriptor.');
    }
    if (typeof media.label !== 'string' || media.label.trim().length === 0) {
        throw new Error('Feed artwork requires a descriptive media.label.');
    }
    const Artwork = Object.hasOwn(artworkTypes, media.type) ? artworkTypes[media.type] : undefined;
    if (!Artwork) {
        throw new Error(`Unsupported feed artwork type: ${String(media.type)}`);
    }

    return (
        <figure className={`feed-media feed-media--${media.type}`}>
            <Artwork type={media.type} variant={media.variant} reducedMotion={reducedMotion} interactive={interactive} />
            <figcaption className="feed-media-description">{media.label}</figcaption>
        </figure>
    );
}

export default memo(PostMedia);
