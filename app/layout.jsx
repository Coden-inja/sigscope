import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--mono' });
export const metadata = { title: 'SIG-SCOPE', description: 'Signal Intelligence Platform' };
export default function L({ children }) { return <html lang="en"><body className={`${inter.variable} ${mono.variable}`}>{children}</body></html> }
