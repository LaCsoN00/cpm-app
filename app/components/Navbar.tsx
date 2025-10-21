"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import React, { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { checkAndAddUser } from "../actions";

const Navbar = () => {
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    {
      href: "/general-projects",
      label: "Collaborations",
    },
    {
      href: "/",
      label: "Mes projets",
    },
  ];

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress && user?.fullName && user?.imageUrl) {
      checkAndAddUser(user.primaryEmailAddress.emailAddress, user.fullName, user.imageUrl);
    }
  }, [user]);

  const isActiveLink = (href: string) =>
    pathname.replace(/\/$/, "") === href.replace(/\/$/, "");

  const renderLinks = (classNames: string) =>
    navLinks.map(({ href, label }) => {
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

        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            className="btn w-fit btn-sm"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu className="w-4" />
          </button>
        </div>

        <div className="hidden sm:flex space-x-4 items-center ">
          {renderLinks("btn")}
          <UserButton />
          <ThemeToggle />
        </div>
      </div>

      <div
        className={`absolute top-0 w-full h-screen flex flex-col gap-2 p-4 transition-all duration-300 sm:hidden  bg-white  z-50 ${
          menuOpen ? "left-0" : "-left-full"
        } `}
      >
        <div className="flex justify-between">
          <UserButton />
          <button
            className="btn w-fit btn-sm"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <X className="w-4" />
          </button>
        </div>
        {renderLinks("btn")}
      </div>
    </div>
  );
};

export default Navbar;

const ThemeToggle = () => {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") || "light";
    setTheme(storedTheme);
    document.documentElement.setAttribute("data-theme", storedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <button onClick={toggleTheme} className="btn btn-sm btn-ghost">
      {theme === "light" ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </button>
  );
};
