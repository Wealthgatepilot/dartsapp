import { render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';
import { applyTheme, currentTheme } from './ui/theme';

applyTheme(currentTheme());

render(<App />, document.getElementById('app')!);
