import { resolveAssetUrl } from '../utils/helpers';

const ImageGrid = ({ images = [], height = 220 }) => {
  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div style={{ height, width: '100%', overflow: 'hidden' }}>
        <img src={resolveAssetUrl(images[0])} alt="Cover" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }} className="hover-scale" />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div style={{ height, width: '100%', display: 'flex', overflow: 'hidden' }}>
        <img src={resolveAssetUrl(images[0])} alt="Cover 1" loading="lazy" style={{ width: '50%', height: '100%', objectFit: 'cover', borderRight: '2px solid #fff' }} />
        <img src={resolveAssetUrl(images[1])} alt="Cover 2" loading="lazy" style={{ width: '50%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  // 3 images
  return (
    <div style={{ height, width: '100%', display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: '50%', height: '100%' }}>
        <img src={resolveAssetUrl(images[0])} alt="Cover 1" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRight: '2px solid #fff' }} />
      </div>
      <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <img src={resolveAssetUrl(images[1])} alt="Cover 2" loading="lazy" style={{ width: '100%', height: '50%', objectFit: 'cover', borderBottom: '2px solid #fff' }} />
        <img src={resolveAssetUrl(images[2])} alt="Cover 3" loading="lazy" style={{ width: '100%', height: '50%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};

export default ImageGrid;
