import AITools from './pages/AITools';
import AdminAuditControl from './pages/AdminAuditControl';
import Analytics from './pages/Analytics';
import AuditDashboard from './pages/AuditDashboard';
import BuildAndBounty from './pages/BuildAndBounty';
import CamlyWithdrawal from './pages/CamlyWithdrawal';
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
import MonitoringDashboard from './pages/MonitoringDashboard';
import PersonalVision from './pages/PersonalVision';
import PuritySpotlight from './pages/PuritySpotlight';
import RewardsManagement from './pages/RewardsManagement';
import Settings from './pages/Settings';
import TestR2Upload from './pages/TestR2Upload';
import UserProfile from './pages/UserProfile';
import WalletBreakdown from './pages/WalletBreakdown';
import WithdrawalManagement from './pages/WithdrawalManagement';
import ReviewPendingActions from './pages/ReviewPendingActions';
import CommunityRewards from './pages/CommunityRewards';
import AdminCommunityRewards from './pages/AdminCommunityRewards';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AITools": AITools,
    "AdminAuditControl": AdminAuditControl,
    "Analytics": Analytics,
    "AuditDashboard": AuditDashboard,
    "BuildAndBounty": BuildAndBounty,
    "CamlyWithdrawal": CamlyWithdrawal,
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
    "MonitoringDashboard": MonitoringDashboard,
    "PersonalVision": PersonalVision,
    "PuritySpotlight": PuritySpotlight,
    "RewardsManagement": RewardsManagement,
    "Settings": Settings,
    "TestR2Upload": TestR2Upload,
    "UserProfile": UserProfile,
    "WalletBreakdown": WalletBreakdown,
    "WithdrawalManagement": WithdrawalManagement,
    "ReviewPendingActions": ReviewPendingActions,
    "CommunityRewards": CommunityRewards,
    "AdminCommunityRewards": AdminCommunityRewards,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};