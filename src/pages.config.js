import Home from './pages/Home';
import Chat from './pages/Chat';
import DailyMessage from './pages/DailyMessage';
import Library from './pages/Library';
import PersonalVision from './pages/PersonalVision';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import Imagine from './pages/Imagine';
import AITools from './pages/AITools';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Chat": Chat,
    "DailyMessage": DailyMessage,
    "Library": Library,
    "PersonalVision": PersonalVision,
    "KnowledgeBase": KnowledgeBase,
    "Settings": Settings,
    "Imagine": Imagine,
    "AITools": AITools,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};