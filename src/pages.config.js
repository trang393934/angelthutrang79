import AITools from './pages/AITools';
import Analytics from './pages/Analytics';
import BuildAndBounty from './pages/BuildAndBounty';
import CamlycoinHistory from './pages/CamlycoinHistory';
import Chat from './pages/Chat';
import DailyMessage from './pages/DailyMessage';
import FUNUsers from './pages/FUNUsers';
import GratitudeJournal from './pages/GratitudeJournal';
import Home from './pages/Home';
import Imagine from './pages/Imagine';
import KnowledgeBase from './pages/KnowledgeBase';
import Landing from './pages/Landing';
import Library from './pages/Library';
import LightLaw from './pages/LightLaw';
import PersonalVision from './pages/PersonalVision';
import RewardsManagement from './pages/RewardsManagement';
import Settings from './pages/Settings';
import TestR2Upload from './pages/TestR2Upload';
import UserProfile from './pages/UserProfile';
import AuditDashboard from './pages/AuditDashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AITools": AITools,
    "Analytics": Analytics,
    "BuildAndBounty": BuildAndBounty,
    "CamlycoinHistory": CamlycoinHistory,
    "Chat": Chat,
    "DailyMessage": DailyMessage,
    "FUNUsers": FUNUsers,
    "GratitudeJournal": GratitudeJournal,
    "Home": Home,
    "Imagine": Imagine,
    "KnowledgeBase": KnowledgeBase,
    "Landing": Landing,
    "Library": Library,
    "LightLaw": LightLaw,
    "PersonalVision": PersonalVision,
    "RewardsManagement": RewardsManagement,
    "Settings": Settings,
    "TestR2Upload": TestR2Upload,
    "UserProfile": UserProfile,
    "AuditDashboard": AuditDashboard,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};