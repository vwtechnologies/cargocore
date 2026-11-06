import {
    FontAwesomeIcon,
    type FontAwesomeIconProps,
} from "@fortawesome/react-fontawesome";
import { config, type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import {
    faAddressCard,
    faAnglesLeft,
    faAnglesRight,
    faArrowLeft,
    faArrowRight,
    faArrowUpRightFromSquare,
    faBars,
    faBriefcase,
    faBuilding,
    faBuildingColumns,
    faCheck,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faCircleExclamation,
    faCircleCheck,
    faCircleXmark,
    faCircleNotch,
    faClock,
    faClockRotateLeft,
    faCreditCard,
    faCube,
    faDatabase,
    faDiagramProject,
    faDownload,
    faEarthAmericas,
    faExpand,
    faEye,
    faEyeSlash,
    faFileLines,
    faFolderOpen,
    faGlobe,
    faHouse,
    faImage,
    faInbox,
    faKey,
    faLayerGroup,
    faLock,
    faMagnifyingGlass,
    faPenToSquare,
    faPhone,
    faPlus,
    faPowerOff,
    faRightFromBracket,
    faRightToBracket,
    faShapes,
    faShieldHalved,
    faSliders,
    faSort,
    faStar,
    faTableColumns,
    faTag,
    faTags,
    faTrashCan,
    faUpload,
    faUser,
    faUserCheck,
    faUserGear,
    faUsers,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";

config.autoAddCss = false;
type IconProps = Omit<FontAwesomeIconProps, "icon" | "size"> & {
    size?: number | string;
    strokeWidth?: number;
};
function makeIcon(definition: IconDefinition) {
    return function Icon({
        size = 16,
        style,
        strokeWidth,
        ...props
    }: IconProps) {
        return (
            <FontAwesomeIcon
                icon={definition}
                {...props}
                style={{ width: size, height: size, ...style }}
            />
        );
    };
}

export const AlertCircle = makeIcon(faCircleExclamation);
export const ArrowDownUp = makeIcon(faSort);
export const ArrowLeft = makeIcon(faArrowLeft);
export const ArrowRight = makeIcon(faArrowRight);
export const ArrowUpRight = makeIcon(faArrowUpRightFromSquare);
export const Box = makeIcon(faCube);
export const BriefcaseBusiness = makeIcon(faBriefcase);
export const Building2 = makeIcon(faBuilding);
export const Check = makeIcon(faCheck);
export const CircleCheck = makeIcon(faCircleCheck);
export const CircleXmark = makeIcon(faCircleXmark);
export const ChevronDown = makeIcon(faChevronDown);
export const ChevronLeft = makeIcon(faChevronLeft);
export const ChevronRight = makeIcon(faChevronRight);
export const ChevronsLeft = makeIcon(faAnglesLeft);
export const ChevronsRight = makeIcon(faAnglesRight);
export const Clock3 = makeIcon(faClock);
export const Contact = makeIcon(faAddressCard);
export const CreditCard = makeIcon(faCreditCard);
export const Database = makeIcon(faDatabase);
export const Download = makeIcon(faDownload);
export const ExternalLink = makeIcon(faArrowUpRightFromSquare);
export const Eye = makeIcon(faEye);
export const EyeOff = makeIcon(faEyeSlash);
export const FileText = makeIcon(faFileLines);
export const FolderKanban = makeIcon(faFolderOpen);
export const Globe = makeIcon(faGlobe);
export const Globe2 = makeIcon(faEarthAmericas);
export const History = makeIcon(faClockRotateLeft);
export const Home = makeIcon(faHouse);
export const Image = makeIcon(faImage);
export const Inbox = makeIcon(faInbox);
export const KeyRound = makeIcon(faKey);
export const Landmark = makeIcon(faBuildingColumns);
export const Layers3 = makeIcon(faLayerGroup);
export const LayoutDashboard = makeIcon(faTableColumns);
export const LoaderCircle = makeIcon(faCircleNotch);
export const LockKeyhole = makeIcon(faLock);
export const LogIn = makeIcon(faRightToBracket);
export const LogOut = makeIcon(faRightFromBracket);
export const Maximize2 = makeIcon(faExpand);
export const Menu = makeIcon(faBars);
export const Network = makeIcon(faDiagramProject);
export const Pencil = makeIcon(faPenToSquare);
export const Phone = makeIcon(faPhone);
export const Plus = makeIcon(faPlus);
export const Power = makeIcon(faPowerOff);
export const Search = makeIcon(faMagnifyingGlass);
export const Shapes = makeIcon(faShapes);
export const Shield = makeIcon(faShieldHalved);
export const ShieldCheck = makeIcon(faShieldHalved);
export const SlidersHorizontal = makeIcon(faSliders);
export const Star = makeIcon(faStar);
export const Tag = makeIcon(faTag);
export const Tags = makeIcon(faTags);
export const Trash2 = makeIcon(faTrashCan);
export const Upload = makeIcon(faUpload);
export const User = makeIcon(faUser);
export const UserCheck = makeIcon(faUserCheck);
export const UserCog = makeIcon(faUserGear);
export const Users = makeIcon(faUsers);
export const X = makeIcon(faXmark);
