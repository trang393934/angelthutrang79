import Home from './pages/Home';
import Chat from './pages/Chat';
import DailyMessage from './pages/DailyMessage';
import Library from './pages/Library';
import PersonalVision from './pages/PersonalVision';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import Imagine from './pages/Imagine';
import AITools from './pages/AITools';
import BuildAndBounty from './pages/BuildAndBounty';
import RewardsManagement from './pages/RewardsManagement';
import FUNUsers from './pages/FUNUsers';
import CamlycoinHistory from './pages/CamlycoinHistory';
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
    "BuildAndBounty": BuildAndBounty,
    "RewardsManagement": RewardsManagement,
    "FUNUsers": FUNUsers,
    "CamlycoinHistory": CamlycoinHistory,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};