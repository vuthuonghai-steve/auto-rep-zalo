import { AppRoot } from '@/screens/AppRoot';
import { render } from 'preact';
import './style.css';

const root = document.getElementById('app');
if (root) {
  render(<AppRoot initialPath="/" />, root);
}
