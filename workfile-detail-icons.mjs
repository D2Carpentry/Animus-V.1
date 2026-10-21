import {createIcons, Pencil, Plus, Ellipsis, Search, SlidersHorizontal, Download, Columns3, Check, ChevronLeft, ChevronRight, Package, DollarSign, Layers, RefreshCw, Star, ChartNoAxesCombined, Trash2, X} from 'lucide';
window.renderAnimusWorkfileIcons = () => createIcons({icons:{Pencil,Plus,Ellipsis},nameAttr:'data-wf-icon'});
window.renderAnimusRevenueIcons = () => createIcons({icons:{Search,SlidersHorizontal,Download,Columns3,Plus,Ellipsis,Check,ChevronLeft,ChevronRight},nameAttr:'data-revenue-icon'});
window.renderAnimusPriceIcons = () => createIcons({icons:{Search,SlidersHorizontal,Download,Columns3,Plus,Ellipsis,ChevronLeft,ChevronRight,Pencil,Package,DollarSign,Layers,RefreshCw,Star,ChartNoAxesCombined,Trash2,X},nameAttr:'data-price-icon'});
window.renderAnimusBusinessIcons = () => createIcons({icons:{SlidersHorizontal,Download,Package,DollarSign,Layers,ChartNoAxesCombined,X},nameAttr:'data-business-icon'});
