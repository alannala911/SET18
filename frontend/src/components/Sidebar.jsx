import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { FiHome } from "react-icons/fi";
import activitiesIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/Aktiviteter.png";
import courseIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/Kurs.png";
import newsIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/Nyheter.png";
import municipalityIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/kommuner.png";
import contactIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/email.png";
import facebookIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/Facebook1.png";
import instagramIcon from "../assets/bilder til nettsiden/Ikoner og Bilder/instagram1.png";


function Sidebar() {
  return (
    <aside className="sidebar">
      <nav
        className="side-links"
        aria-label="Hovedmeny"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <FiHome className="navigation-icon" aria-hidden="true" />
          Hjem
        </NavLink>

        <NavLink
          to="/kurs"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <img
            className="menu-icon"
            src={courseIcon}
            alt=""
          />
          Kurs
        </NavLink>

        <NavLink
          to="/aktiviteter"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <img
            className="menu-icon"
            src={activitiesIcon}
            alt=""
          />
          Aktiviteter
        </NavLink>

        <NavLink
          to="/nyheter"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <img
            className="menu-icon"
            src={newsIcon}
            alt=""
          />
          Nyheter
        </NavLink>

        <NavLink
          to="/om-oss"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <span
            className="temporary-icon"
            aria-hidden="true"
          >
            ●
          </span>
          Om oss
        </NavLink>

        <NavLink
          to="/kommuner"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <img
            className="menu-icon"
            src={municipalityIcon}
            alt=""
          />
          Kommuner
        </NavLink>

        <NavLink
          to="/kontakt"
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <img
            className="menu-icon"
            src={contactIcon}
            alt=""
          />
          Kontakt oss
        </NavLink>
      </nav>

      <section className="social">
        <h2>Følg oss</h2>

        <nav
          className="social-links"
          aria-label="Sosiale medier"
        >
          <a href="#" aria-label="Facebook">
            <img src={facebookIcon} alt="" />
          </a>

          <a href="#" aria-label="Instagram">
            <img src={instagramIcon} alt="" />
          </a>
        </nav>
      </section>
    </aside>
  );
}

export default Sidebar;