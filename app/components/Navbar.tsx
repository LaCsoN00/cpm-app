"use client";

import { createClient } from "../../utils/supabase/client";
import { Menu, X, LogOut, Moon, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import React, { useEffect, useState, useRef } from "react";
import { checkAndAddUser } from "../actions";
import { Role } from "@prisma/client";
import { useSupabaseUserWithRole } from "../hooks/useSupabaseUserWithRole";

interface NavbarProps {
  userRole: Role | "GUEST";
}

const Navbar = ({ userRole }: NavbarProps) => {
  const { user, imageUrl, name } = useSupabaseUserWithRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuMobileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const getRoleBadgeClass = (role: Role | "GUEST") => {
    switch (role) {
      case Role.ADMIN:
        return "badge-error";
      case Role.USER:
        return "badge-success";
      case "GUEST":
        return "badge-info";
      default:
        return "badge-neutral";
    }
  };

  const navLinks = [
    {
      href: "/general-projects",
      label: "Collaborations",
      roles: [Role.ADMIN, Role.USER],
    },
    {
      href: "/",
      label: "Mes projets",
      roles: [Role.ADMIN, Role.USER],
    },
    {
      href: "/admin",
      label: "Administration",
      roles: [Role.ADMIN],
    },
  ];

  useEffect(() => {
    if (user?.email && user?.user_metadata?.full_name && user?.user_metadata?.avatar_url) {
      checkAndAddUser(user.email, user.user_metadata.full_name, user.user_metadata.avatar_url);
    }
  }, [user]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") || "light";
    setTheme(storedTheme);
    document.documentElement.setAttribute("data-theme", storedTheme);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (userMenuMobileRef.current && !userMenuMobileRef.current.contains(event.target as Node)) {
        setMobileUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActiveLink = (href: string) =>
    pathname.replace(/\/$/, "") === href.replace(/\/$/, "");

  const renderLinks = (classNames: string) =>
    navLinks
      .filter((link) => link.roles.includes(userRole as Role))
      .map(({ href, label }) => {
        return (
          <Link
            key={href}
            href={href}
            className={`btn-sm ${classNames} ${
              isActiveLink(href) ? "btn-primary" : ""
            }`}
          >
            {label}
          </Link>
        );
      });

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/sign-in";
  };

  const UserDropdownMenu = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-base-300 bg-base-200">
            <div className="mb-3">
              <p className="font-semibold text-sm">{name || "Utilisateur"}</p>
              <p className="text-xs text-base-content/60 break-all">{user?.email}</p>
            </div>
            <div className={`badge badge-lg w-full py-3 font-semibold text-white uppercase tracking-wider text-xs ${getRoleBadgeClass(userRole)}`}>
              {userRole === "GUEST" ? "Invité" : userRole}
            </div>
          </div>
          <div className="p-2">
            <button
              onClick={() => {
                toggleTheme();
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors duration-150"
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-4 h-4" />
                  <span className="text-sm">Mode sombre</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4" />
                  <span className="text-sm">Mode clair</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                handleLogout();
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors duration-150 text-error"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Déconnexion</span>
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="border-b boder-base-300  px-5 md:px-[10%] py-4 relative ">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <div className="flex items-center">
            <Image src="/icon-512x512.png" alt="Logo" width={45} height={45} />
          </div>
          <span className="ml-3 font-bold text-3xl">
            CPM <span className="text-primary">Project</span>
          </span>
        </div>

        {/* Mobile User Menu and Hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            className="btn w-fit btn-sm"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu className="w-4" />
          </button>
          {/* Mobile User Avatar Dropdown */}
          <div className="relative" ref={userMenuMobileRef}>
            <button
              onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
              className="flex items-center hover:opacity-80 transition-opacity duration-200"
              title="Menu utilisateur"
            >
              {imageUrl ? (
                <div className="w-10 h-10 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-base-100 overflow-hidden cursor-pointer hover:ring-offset-1 transition-all duration-200">
                  <Image
                    src={imageUrl}
                    alt="Photo de profil"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-all duration-200">
                  {name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </div>
              )}
            </button>
            <UserDropdownMenu open={mobileUserMenuOpen} onOpenChange={setMobileUserMenuOpen} />
          </div>
        </div>

        <div className="hidden sm:flex space-x-4 items-center ">
          {renderLinks("btn")}
          
          {/* User Avatar Dropdown Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-200"
              title="Menu utilisateur"
            >
              {imageUrl ? (
                <div className="w-10 h-10 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-base-100 overflow-hidden cursor-pointer hover:ring-offset-1 transition-all duration-200">
                  <Image
                    src={imageUrl}
                    alt="Photo de profil"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-all duration-200">
                  {name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </div>
              )}
            </button>

            {/* Dropdown Menu */}
            <UserDropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen} />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`absolute top-0 w-full h-screen flex flex-col gap-2 p-4 transition-all duration-300 sm:hidden bg-base-100 z-50 ${
          menuOpen ? "left-0" : "-left-full"
        } `}
      >
        <div className="flex justify-between items-center mb-6">
          <span className="font-bold text-lg">Menu</span>
          <button
            className="btn w-fit btn-sm"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <X className="w-4" />
          </button>
        </div>

        {/* Mobile Navigation Links */}
        <div className="flex flex-col gap-2 mb-4">
          {renderLinks("btn w-full justify-start")}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
