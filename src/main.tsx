import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ChunkErrorBoundary} from './components/ChunkErrorBoundary.tsx';
import {installGlobalChunkErrorRecovery} from './utils/chunkRecovery.ts';
import './index.css';
import './styles/datacar-arcade.css';

installGlobalChunkErrorRecovery();

createRoot(document.getElementById('root')!).render(
  <ChunkErrorBoundary>
    <App />
  </ChunkErrorBoundary>,
);
